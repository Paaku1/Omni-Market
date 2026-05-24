package com.omnimarket.biddingengine.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "bids.exchange";
    public static final String QUEUE = "bids.queue";
    public static final String ROUTING_KEY = "bid.placed";

    @Bean
    public TopicExchange bidsExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue bidsQueue() {
        return new Queue(QUEUE, true); // Durable queue
    }

    @Bean
    public Binding bidsBinding(Queue bidsQueue, TopicExchange bidsExchange) {
        return BindingBuilder.bind(bidsQueue).to(bidsExchange).with(ROUTING_KEY);
    }
}
