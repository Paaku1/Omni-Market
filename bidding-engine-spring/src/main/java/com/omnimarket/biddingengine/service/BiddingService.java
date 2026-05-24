package com.omnimarket.biddingengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omnimarket.biddingengine.config.RabbitConfig;
import com.omnimarket.biddingengine.dto.BidRequest;
import com.omnimarket.biddingengine.dto.BidResponse;
import com.omnimarket.biddingengine.model.Bid;
import com.omnimarket.biddingengine.repository.AuctionRepository;
import com.omnimarket.biddingengine.repository.BidRepository;
import com.omnimarket.biddingengine.repository.ProductRepository;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class BiddingService {

    private final AuctionRepository auctionRepository;
    private final ProductRepository productRepository;
    private final BidRepository bidRepository;
    private final ReactiveRedisTemplate<String, String> redisTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public BiddingService(
            AuctionRepository auctionRepository,
            ProductRepository productRepository,
            BidRepository bidRepository,
            @Qualifier("reactiveRedisTemplate") ReactiveRedisTemplate<String, String> redisTemplate,
            RabbitTemplate rabbitTemplate,
            ObjectMapper objectMapper) {
        this.auctionRepository = auctionRepository;
        this.productRepository = productRepository;
        this.bidRepository = bidRepository;
        this.redisTemplate = redisTemplate;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
    }

    private String getRedisKey(UUID auctionId) {
        return "auction:" + auctionId + ":highest_bid";
    }

    /**
     * Places a bid reactively.
     * Validates auction status, checks Redis cache first (falling back to database and product starting price),
     * saves the new bid, updates the cache, and publishes a RabbitMQ event.
     */
    public Mono<BidResponse> placeBid(BidRequest request, String bidderName) {
        UUID auctionId = request.getAuctionId();
        BigDecimal bidAmount = request.getAmount();
        UUID bidderId = request.getBidderId();

        return auctionRepository.findById(auctionId)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Auction not found.")))
                .flatMap(auction -> {
                    // Check if auction is closed
                    if (auction.isClosed() || LocalDateTime.now().isAfter(auction.getEndTime())) {
                        return Mono.error(new IllegalArgumentException("This auction has already closed!"));
                    }

                    String redisKey = getRedisKey(auctionId);
                    return redisTemplate.opsForValue().get(redisKey)
                            .map(BigDecimal::new)
                            .switchIfEmpty(
                                    // Fallback 1: Fetch highest bid from database
                                    bidRepository.findFirstByAuctionIdOrderByAmountDesc(auctionId)
                                            .map(Bid::getAmount)
                                            .switchIfEmpty(
                                                    // Fallback 2: Get product starting price
                                                    productRepository.findById(auction.getProductId())
                                                            .map(product -> product.getStartingPrice() != null ? product.getStartingPrice() : BigDecimal.ZERO)
                                                            .defaultIfEmpty(BigDecimal.ZERO)
                                            )
                                            .flatMap(baseline -> redisTemplate.opsForValue().set(redisKey, baseline.toString())
                                                    .thenReturn(baseline))
                            )
                            .flatMap(highestPrice -> {
                                if (bidAmount.compareTo(highestPrice) <= 0) {
                                    return Mono.error(new IllegalArgumentException("Bid must be higher than the current price! Current highest: " + highestPrice));
                                }

                                // Construct the new Bid entity
                                Bid newBid = Bid.builder()
                                        .id(UUID.randomUUID())
                                        .auctionId(auctionId)
                                        .bidderId(bidderId)
                                        .amount(bidAmount)
                                        .createdAt(LocalDateTime.now())
                                        .build();

                                // Save, cache, publish, and return Response
                                return bidRepository.save(newBid)
                                        .flatMap(savedBid -> redisTemplate.opsForValue().set(redisKey, bidAmount.toString())
                                                .then(publishRabbitMqEvent(savedBid))
                                                .thenReturn(BidResponse.builder()
                                                        .type("NEW_BID")
                                                        .auctionId(auctionId)
                                                        .amount(bidAmount)
                                                        .bidderId(bidderId)
                                                        .bidderName(bidderName)
                                                        .build()));
                            });
                });
    }

    /**
     * Publishes bid event to RabbitMQ on a boundedElastic scheduler to prevent blocking.
     */
    private Mono<Void> publishRabbitMqEvent(Bid bid) {
        return Mono.fromRunnable(() -> {
            try {
                String json = objectMapper.writeValueAsString(bid);
                rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ROUTING_KEY, json);
            } catch (Exception e) {
                // Log exception gracefully
                System.err.println("RabbitMQ Publish Error: " + e.getMessage());
            }
        }).subscribeOn(Schedulers.boundedElastic()).then();
    }
}
