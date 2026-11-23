package com.stadium.inventory.adapter.persistence.repository;

import com.stadium.inventory.adapter.persistence.BlockEntity;
import com.stadium.inventory.adapter.persistence.BlockId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlockRepository extends JpaRepository<BlockEntity, BlockId> {
}

