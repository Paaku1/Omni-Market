package com.omnimarket.biddingengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("auctions")
public class Auction {

    @Id
    private UUID id;

    @Column("product_id")
    private UUID productId;

    @Column("end_time")
    private LocalDateTime endTime;

    @Column("is_closed")
    private boolean isClosed;
}
