package com.stadium.inventory.adapter.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.stadium.inventory.TestcontainersConfiguration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.JdbcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

@JdbcTest
@Import(TestcontainersConfiguration.class)
class SeatMapSchemaTest {

    @Autowired
    JdbcClient jdbc;

    @Test
    void createsTheLayoutTablesAndNoSeatsTable() {
        List<String> tables = jdbc.sql("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history'
                """).query(String.class).list();

        assertThat(tables).containsExactlyInAnyOrder("seat_maps", "blocks", "seat_claims");
    }

    private void aSeatMap(long matchId) {
        jdbc.sql("""
                INSERT INTO seat_maps (match_id, layout_version, seat_count, generated_at)
                VALUES (?, 'stadium-v1', 60560, now())
                """).params(matchId).update();
    }

    private void aBlock(long matchId, String blockId, String level, int position,
                        String side, String tier, String rowSeats) {
        jdbc.sql("""
                INSERT INTO blocks (match_id, block_id, level, position, side, tier, row_seats)
                VALUES (?, ?, ?, ?, ?, ?, ?::int[])
                """)
                .params(matchId, blockId, level, position, side, tier, rowSeats)
                .update();
    }

    private void block214() {
        aSeatMap(1);
        aBlock(1, "214", "CLUB", 13, "NORTH", "VIP_2",
                "{22,22,23,23,23,23,24,24,24,24,25,25}");
    }

    private void aClaim(long matchId, String blockId, String seatId, String status) {
        jdbc.sql("""
                INSERT INTO seat_claims (match_id, seat_id, block_id, status, order_id, hold_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """)
                .params(matchId, seatId, blockId, status, UUID.randomUUID(), UUID.randomUUID())
                .update();
    }
}