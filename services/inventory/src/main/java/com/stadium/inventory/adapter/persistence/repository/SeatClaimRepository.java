package com.stadium.inventory.adapter.persistence.repository;

import com.stadium.inventory.adapter.persistence.SeatClaimEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeatClaimRepository extends JpaRepository<SeatClaimEntity, Long> {
}