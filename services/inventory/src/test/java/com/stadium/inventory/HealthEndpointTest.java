package com.stadium.inventory;

// imports: let your IDE add them (SpringBootTest, WebEnvironment, AutoConfigureRestTestClient,
// RestTestClient, Test, Autowired)

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import org.springframework.test.web.servlet.client.RestTestClient;

@ImportTestcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient                                  // the annotation that gives you a RestTestClient
class HealthEndpointTest {

    @Test
    void healthEndpointReportsUp(@Autowired RestTestClient client) {
        client.get().uri("/actuator/health")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("UP");
    }
    @Test
    void healthReportsTheDatabaseUp(@Autowired RestTestClient client) {
        client.get().uri("/actuator/health")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.components.db.status").isEqualTo("UP");
    }
}