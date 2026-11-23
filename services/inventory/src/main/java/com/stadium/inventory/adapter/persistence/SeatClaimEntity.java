package com.stadium.inventory.adapter.persistence;

import com.stadium.inventory.domain.SeatClaimStatus;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.AccessLevel;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "seat_claims")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SeatClaimEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @Column(name = "seat_id", nullable = false, length = 16)
    private String seatId;

    @Column(name = "block_id", nullable = false, length = 3)
    private String blockId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SeatClaimStatus status;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "hold_id", nullable = false)
    private UUID holdId;

    @Generated(event = EventType.INSERT)
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    public SeatClaimEntity(Long matchId, String blockId, String seatId, SeatClaimStatus status,
                           UUID orderId, UUID holdId) {
        this.matchId = matchId;
        this.blockId = blockId;
        this.seatId = seatId;
        this.status = status;
        this.orderId = orderId;
        this.holdId = holdId;
    }
}