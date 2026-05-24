package com.omnimarket.biddingengine.repository;

import com.omnimarket.biddingengine.model.Bid;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Repository
public interface BidRepository extends ReactiveCrudRepository<Bid, UUID> {
    Mono<Bid> findFirstByAuctionIdOrderByAmountDesc(UUID auctionId);
}
