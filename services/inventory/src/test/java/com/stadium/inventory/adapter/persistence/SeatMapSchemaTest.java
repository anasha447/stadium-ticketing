package com.stadium.inventory.adapter.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.stadium.inventory.TestcontainersConfiguration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.JdbcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
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
    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            unknown level       | MIDDLE | 13 | WEST   | VIP_1 | {22,22,23} | blocks_level_check
            position past 39    | CLUB   | 40 | WEST   | VIP_1 | {22,22,23} | blocks_position_check
            unknown side        | CLUB   | 13 | INSIDE | VIP_1 | {22,22,23} | blocks_side_check
            unknown tier        | CLUB   | 13 | WEST   | GOLD  | {22,22,23} | blocks_tier_check
            no Rows             | CLUB   | 13 | WEST   | VIP_1 | {}         | blocks_row_seats_check
            a Row of zero Seats | CLUB   | 13 | WEST   | VIP_1 | {22,0,23}  | blocks_row_seats_check
            a Row with no count | CLUB   | 13 | WEST   | VIP_1 | {22,NULL}  | blocks_row_seats_check
            """)
    void rejectsAnInvalidBlock(String why, String level, int position, String side,
                               String tier, String rowSeats, String constraint) {
        aSeatMap(1);

        assertThatThrownBy(() -> aBlock(1, "214", level, position, side, tier, rowSeats))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining(constraint);
    }

    @Test
    void rejectsASeatMapWithNoSeats() {
        assertThatThrownBy(() -> jdbc.sql("""
                INSERT INTO seat_maps (match_id, layout_version, seat_count, generated_at)
                VALUES (1, 'stadium-v1', 0, now())
                """).update())
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("seat_maps_seat_count_check");
    }
}