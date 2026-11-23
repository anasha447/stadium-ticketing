package com.stadium.inventory.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "seat_maps")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class SeatMapEntity {

    @Id
    @Column(name = "match_id")
    private Long matchId;

    @Column(name = "layout_version", nullable = false, length = 32)
    private String layoutVersion;

    @Column(name = "seat_count", nullable = false)
    private int seatCount;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}