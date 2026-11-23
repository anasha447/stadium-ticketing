package com.stadium.inventory.adapter.persistence.repository;

import com.stadium.inventory.adapter.persistence.SeatMapEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeatMapRepository extends JpaRepository<SeatMapEntity, Long> {
}
