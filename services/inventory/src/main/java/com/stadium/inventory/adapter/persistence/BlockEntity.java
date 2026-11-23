package com.stadium.inventory.adapter.persistence;

import com.stadium.inventory.domain.Level;
import com.stadium.inventory.domain.Side;
import com.stadium.inventory.domain.Tier;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "blocks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BlockEntity {

    @EmbeddedId
    private BlockId id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Level level;

    @Column(nullable = false)
    private short position;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Side side;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Tier tier;

    @Column(name = "row_seats", nullable = false)
    private int[] rowSeats;
}