-- TKT-103: the layout of a Match's stadium (ADR-0007) and one Seat Claim per sale.
CREATE TABLE seat_maps (
    match_id        BIGINT      PRIMARY KEY,
    layout_version  VARCHAR(32) NOT NULL,
    seat_count      INT         NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE blocks (
    match_id   BIGINT      NOT NULL REFERENCES seat_maps(match_id),
    block_id   VARCHAR(3)  NOT NULL,
    level      VARCHAR(8)  NOT NULL,
    position   SMALLINT    NOT NULL,
    side       VARCHAR(8)  NOT NULL,
    tier       VARCHAR(16) NOT NULL,
    row_seats  INT[]       NOT NULL,
    PRIMARY KEY (match_id, block_id),
    UNIQUE (match_id, level, position)
);

CREATE TABLE seat_claims (
    id          BIGSERIAL   PRIMARY KEY,
    match_id    BIGINT      NOT NULL,
    seat_id     VARCHAR(16) NOT NULL,
    block_id    VARCHAR(3)  NOT NULL,
    status      VARCHAR(16) NOT NULL,
    order_id    UUID        NOT NULL,
    hold_id     UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliberately no seats table (ADR-0007) and no holds table: Holds are Redis-only (ADR-0001).