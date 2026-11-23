-- TKT-103: the layout of a Match's stadium (ADR-0007) and one Seat Claim per sale.
CREATE TABLE seat_maps (
    match_id        BIGINT      PRIMARY KEY,
    layout_version  VARCHAR(32) NOT NULL,
    seat_count      INT         NOT NULL CHECK (seat_count > 0),
    generated_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE blocks (
    match_id   BIGINT      NOT NULL REFERENCES seat_maps(match_id),
    block_id   VARCHAR(3)  NOT NULL,
    level      VARCHAR(8)  NOT NULL CHECK (level IN ('LOWER','CLUB','UPPER')),
    position   SMALLINT    NOT NULL CHECK (position BETWEEN 0 AND 39),
    side       VARCHAR(8)  NOT NULL CHECK (side IN ('WEST','NORTH','EAST','SOUTH')),
    tier       VARCHAR(16) NOT NULL
               CHECK (tier IN ('CLUB_PREMIUM','VIP_1','VIP_2','STANDARD')),
    row_seats  INT[]       NOT NULL
               CHECK (cardinality(row_seats) > 0
                      AND array_position(row_seats, NULL) IS NULL   -- no Row without a number
                      AND 0 < ALL (row_seats)),
    PRIMARY KEY (match_id, block_id),
    UNIQUE (match_id, level, position)
);

CREATE TABLE seat_claims (
    id          BIGSERIAL   PRIMARY KEY,
    match_id    BIGINT      NOT NULL,
    seat_id     VARCHAR(16) NOT NULL,
    block_id    VARCHAR(3)  NOT NULL,
    status      VARCHAR(16) NOT NULL CHECK (status IN ('SOLD','CANCELLED')),
    order_id    UUID        NOT NULL,
    hold_id     UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (match_id, block_id) REFERENCES blocks(match_id, block_id),
    -- the Seat id names its own Block; whether Row and number fit is checked in Java
    CHECK (seat_id ~ ('^' || block_id || '-R[0-9]{2}-[0-9]{2}$'))
);

-- The overselling backstop: at most one SOLD claim per Seat of a Match.
CREATE UNIQUE INDEX uniq_sold_seat ON seat_claims (match_id, seat_id)
    WHERE status = 'SOLD';

   -- Deliberately no seats table (ADR-0007) and no holds table: Holds are Redis-only (ADR-0001).