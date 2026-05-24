package com.omnimarket.biddingengine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("products")
public class Product {

    @Id
    private UUID id;

    private String name;

    private String description;

    @Column("starting_price")
    private BigDecimal startingPrice;

    @Column("seller_id")
    private UUID sellerId;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("image_url")
    private String imageUrl;
}
