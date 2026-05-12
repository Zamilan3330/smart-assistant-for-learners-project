-- CreateTable
CREATE TABLE "flashcard_srs_states" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "card_hash" VARCHAR(64) NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "hint" TEXT,
    "ku_code" VARCHAR(120),
    "ka_code" VARCHAR(100),
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "ease_factor" DECIMAL(6,4) NOT NULL DEFAULT 2.5000,
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "due_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcard_srs_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_flashcard_srs_user_due" ON "flashcard_srs_states"("user_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_flashcard_srs_user_card" ON "flashcard_srs_states"("user_id", "card_hash");

-- AddForeignKey
ALTER TABLE "flashcard_srs_states" ADD CONSTRAINT "flashcard_srs_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
