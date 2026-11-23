package com.stadium.inventory.adapter.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.stadium.inventory.TestcontainersConfiguration;
import com.stadium.inventory.adapter.persistence.repository.BlockRepository;
import com.stadium.inventory.adapter.persistence.repository.SeatMapRepository;
import com.stadium.inventory.domain.Level;
import com.stadium.inventory.domain.Side;
import com.stadium.inventory.domain.Tier;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;

@DataJpaTest
@Import(TestcontainersConfiguration.class)
class SeatMapPersistenceTest {

    @Autowired
    SeatMapRepository seatMaps;

    @Autowired
    BlockRepository blocks;

    @Autowired
    TestEntityManager entityManager;

    @Test
    void aBlockComesBackExactlyAsSaved() {
        seatMaps.save(new SeatMapEntity(1L, "stadium-v1", 60_560, Instant.parse("2026-11-22T10:00:00Z")));
        blocks.save(new BlockEntity(new BlockId(1L, "214"), Level.CLUB, (short) 13, Side.NORTH, Tier.VIP_2,
                new int[] {22, 22, 23, 23, 23, 23, 24, 24, 24, 24, 25, 25}));
        entityManager.flush();   // send the INSERTs now
        entityManager.clear();   // empty the notebook, so the read below really goes to Postgres

        BlockEntity block = blocks.findById(new BlockId(1L, "214")).orElseThrow();

        assertThat(block.getLevel()).isEqualTo(Level.CLUB);
        assertThat(block.getPosition()).isEqualTo((short) 13);
        assertThat(block.getSide()).isEqualTo(Side.NORTH);
        assertThat(block.getTier()).isEqualTo(Tier.VIP_2);
        assertThat(block.getRowSeats()).containsExactly(22, 22, 23, 23, 23, 23, 24, 24, 24, 24, 25, 25);
        assertThat(entityManager.getEntityManager()
                .createNativeQuery("SELECT tier FROM blocks").getSingleResult())
                .isEqualTo("VIP_2");   // stored as text, not as a number
    }
}