package com.omnimarket.biddingengine.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BidRequest {
    private UUID auctionId;
    private UUID bidderId;
    private BigDecimal amount;
}
