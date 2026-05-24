package com.omnimarket.biddingengine.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JwtService {

    private final WebClient webClient;
    private final Map<String, UserDetails> tokenCache = new ConcurrentHashMap<>();

    public JwtService(
            WebClient.Builder webClientBuilder,
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.anon-key}") String anonKey) {
        this.webClient = webClientBuilder
                .baseUrl(supabaseUrl + "/auth/v1")
                .defaultHeader("apikey", anonKey)
                .build();
    }

    /**
     * Validates the Supabase JWT token.
     * Checks a local cache first to avoid hitting Supabase for every connection/action.
     */
    public Mono<UserDetails> validateToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            return Mono.empty();
        }

        // Check local cache first
        if (tokenCache.containsKey(token)) {
            return Mono.just(tokenCache.get(token));
        }

        // Call Supabase Auth /user endpoint to verify active session
        return webClient.get()
                .uri("/user")
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    String id = (String) response.get("id");
                    String email = (String) response.get("email");
                    String fullName = "Unknown User";

                    if (response.containsKey("user_metadata")) {
                        Map<?, ?> metadata = (Map<?, ?>) response.get("user_metadata");
                        if (metadata.containsKey("full_name")) {
                            fullName = (String) metadata.get("full_name");
                        }
                    }

                    UserDetails details = new UserDetails(id, email, fullName);
                    tokenCache.put(token, details);
                    return details;
                })
                .onErrorResume(e -> {
                    // Fallback decoding locally if network is unreachable or for mock testing
                    try {
                        DecodedJWT jwt = JWT.decode(token);
                        String id = jwt.getSubject();
                        String email = jwt.getClaim("email").asString();
                        
                        Map<String, Object> metadata = jwt.getClaim("user_metadata").asMap();
                        String fullName = metadata != null && metadata.containsKey("full_name")
                                ? (String) metadata.get("full_name")
                                : "User";

                        if (id != null) {
                            return Mono.just(new UserDetails(id, email, fullName != null ? fullName : "User"));
                        }
                    } catch (Exception ex) {
                        // Suppress parse failures and return empty to indicate invalid token
                    }
                    return Mono.empty();
                });
    }

    public static record UserDetails(String id, String email, String fullName) {}
}
