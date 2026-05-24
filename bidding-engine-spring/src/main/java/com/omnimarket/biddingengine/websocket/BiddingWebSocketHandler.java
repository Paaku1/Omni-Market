package com.omnimarket.biddingengine.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.omnimarket.biddingengine.dto.BidRequest;
import com.omnimarket.biddingengine.dto.BidResponse;
import com.omnimarket.biddingengine.service.BiddingService;
import com.omnimarket.biddingengine.service.JwtService;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class BiddingWebSocketHandler implements WebSocketHandler {

    private final BiddingService biddingService;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    public BiddingWebSocketHandler(
            BiddingService biddingService,
            JwtService jwtService,
            ObjectMapper objectMapper) {
        this.biddingService = biddingService;
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        String token = extractToken(session.getHandshakeInfo().getUri());

        return jwtService.validateToken(token)
                .flatMap(userDetails -> {
                    // Authenticated successfully: add session to active connections pool
                    sessions.add(session);

                    // Handle incoming messaging pipeline
                    Mono<Void> receiveMono = session.receive()
                            .flatMap(message -> {
                                String payload = message.getPayloadAsText();
                                return processIncomingBid(payload, userDetails, session)
                                        .onErrorResume(ex -> {
                                            // Return standard plain text error directly to the sender session
                                            return session.send(Mono.just(session.textMessage(ex.getMessage())));
                                        });
                            })
                            .then();

                    // Run the receiver pipeline, then remove session from pool on termination
                    return receiveMono.doFinally(signal -> sessions.remove(session));
                })
                .switchIfEmpty(Mono.defer(() -> {
                    // Authentication failed: return error message and close session
                    return session.send(Mono.just(session.textMessage("Authentication failed. Invalid token.")))
                            .then(session.close());
                }));
    }

    /**
     * Parses the incoming text payload, validates permissions, and triggers bidding service.
     */
    private Mono<Void> processIncomingBid(String payload, JwtService.UserDetails user, WebSocketSession senderSession) {
        return Mono.fromCallable(() -> objectMapper.readValue(payload, BidRequest.class))
                .onErrorMap(e -> new IllegalArgumentException("Invalid bid format."))
                .flatMap(request -> {
                    // Security verification: check if bidder ID matches authenticated session user
                    if (request.getBidderId() == null || !request.getBidderId().toString().equals(user.id())) {
                        return Mono.error(new IllegalArgumentException("Unauthorized: Bidder ID mismatch."));
                    }

                    return biddingService.placeBid(request, user.fullName())
                            .flatMap(this::broadcastBidResponse);
                });
    }

    /**
     * Broadcasts the successful bid update to all open WebSocket sessions.
     */
    private Mono<Void> broadcastBidResponse(BidResponse response) {
        return Mono.defer(() -> {
            try {
                String json = objectMapper.writeValueAsString(response);
                return Flux.fromIterable(sessions)
                        .filter(WebSocketSession::isOpen)
                        .flatMap(session -> session.send(Mono.just(session.textMessage(json))))
                        .then();
            } catch (Exception e) {
                return Mono.error(e);
            }
        });
    }

    /**
     * Helper to extract the token parameter from the WebSocket handshake URI.
     */
    private String extractToken(URI uri) {
        String query = uri.getQuery();
        if (query != null && query.contains("token=")) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("token=")) {
                    return param.substring(6);
                }
            }
        }
        return "";
    }
}
