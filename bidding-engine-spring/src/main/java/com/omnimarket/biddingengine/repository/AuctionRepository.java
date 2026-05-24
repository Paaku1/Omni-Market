package com.omnimarket.biddingengine.repository;

import com.omnimarket.biddingengine.model.Auction;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AuctionRepository extends ReactiveCrudRepository<Auction, UUID> {
}
