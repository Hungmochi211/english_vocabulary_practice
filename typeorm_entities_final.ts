/**
 * TypeORM Entities (v3.2) — PostgreSQL 16+ & pgvector
 * Dự án: Website Hỗ trợ Học Từ Vựng Tiếng Anh Thông Minh (Nhóm 51 - K68CNTTF - FITA VNUA)
 * Đồng bộ 100% với Schema PostgreSQL v3.2 (19 bảng thực thể - 14 ENUMs)
 *
 * Lưu ý triển khai:
 * 1. Đặt `synchronize: false` trên TypeORM và chạy migration SQL đi kèm trước.
 * 2. Bật extension trong PostgreSQL:
 *      CREATE EXTENSION IF NOT EXISTS vector;
 *      CREATE EXTENSION IF NOT EXISTS pg_trgm;
 * 3. Các chỉ mục chuyên biệt (HNSW vector_cosine_ops, GIN pg_trgm, LOWER(word) text_pattern_ops,
 *    DEFERRABLE UNIQUE trên deck_vocabularies) được tạo qua migration SQL đi kèm.
 * 4. Trong main.ts gọi `types.setTypeParser(1082, (v: string) => v)` (từ gói `pg`)
 *    để cột `DATE` trả về chuỗi 'YYYY-MM-DD' nhất quán theo users.timezone.
 */

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

// ============================================================================
// 1. CONSTANTS & ENUMS (14 ENUMS)
// ============================================================================

export const OXFORD_POS_TAGS = [
  'n.',
  'v.',
  'adj.',
  'adv.',
  'prep.',
  'conj.',
  'pron.',
  'det.',
  'exclam.',
  'number',
  'modal v.',
  'article',
  'indefinite article.',
  'infinitive marker',
] as const;

export type OxfordPosTag = (typeof OXFORD_POS_TAGS)[number];

export enum UserRole {
  LEARNER = 'learner',
  ADMIN = 'admin',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

export enum CefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export enum DeckCefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
  ALL = 'all',
}

export enum DeckType {
  SYSTEM_LESSON = 'system_lesson',
  CUSTOM_DECK = 'custom_deck',
}

export enum ProgressStatus {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEWING = 'reviewing',
  MASTERED = 'mastered',
}

export enum SessionType {
  LESSON_STUDY = 'lesson_study',
  LESSON_PRACTICE = 'lesson_practice',
  SM2_REVIEW = 'sm2_review',
  MIXED_QUIZ = 'mixed_quiz',
}

export enum PracticeMode {
  FLASHCARD = 'flashcard',
  MULTIPLE_CHOICE = 'multiple_choice',
  TRANSLATION_TYPING = 'translation_typing',
  DICTATION_LISTENING = 'dictation_listening',
  CLOZE_TEST = 'cloze_test',
}

export enum GradingStatus {
  EXACT = 'exact',
  NEAR_MATCH = 'near_match',
  PHONETIC_MATCH = 'phonetic_match',
  INCORRECT = 'incorrect',
}

export enum BadgeConditionType {
  STREAK = 'streak',
  WORDS_COUNT = 'words_count',
  PERFECT_SCORE = 'perfect_score',
}

export enum ChatType {
  AI_ASSISTANT = 'ai_assistant',
  ADMIN_SUPPORT = 'admin_support',
}

export enum ChatStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum ChatSender {
  USER = 'user',
  ASSISTANT = 'assistant',
  ADMIN = 'admin',
}

export enum AiFeedbackType {
  GRAMMAR_CHECK = 'grammar_check',
  EXPLANATION = 'explanation',
  EXAMPLE_GENERATION = 'example_generation',
  GENERAL = 'general',
}

export type AllowedAiToolName =
  | 'lookup_vocabulary'
  | 'get_user_study_status'
  | 'generate_quick_quiz';

export interface AiToolCallRecord {
  toolName: AllowedAiToolName;
  args: Record<string, unknown>;
  resultSummary?: Record<string, unknown> | string;
  executedAt: string;
}

// ============================================================================
// 2. VALUE TRANSFORMERS (PostgreSQL DECIMAL & pgvector)
// ============================================================================

export class DecimalTransformer implements ValueTransformer {
  constructor(private readonly scale: number = 2) {}

  to(value?: number | null): string | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Invalid decimal value: ${value}`);
    }
    return num.toFixed(this.scale);
  }

  from(value?: string | number | null): number | null {
    if (value === null || value === undefined) return null;
    return Number(value);
  }
}

export class VectorTransformer implements ValueTransformer {
  constructor(private readonly expectedDimensions: number = 768) {}

  to(value?: number[] | null): string | null {
    if (!value) return null;
    if (value.length !== this.expectedDimensions) {
      throw new Error(
        `Invalid embedding dimension: expected ${this.expectedDimensions}, got ${value.length}`,
      );
    }
    return `[${value.join(',')}]`;
  }

  from(value?: string | number[] | null): number[] | null {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.map(Number);
    const trimmed = value.trim().replace(/^\[|\]$/g, '');
    if (!trimmed) return [];
    return trimmed.split(',').map((v) => Number(v.trim()));
  }
}

const decimalScale2 = new DecimalTransformer(2);
const decimalScale4 = new DecimalTransformer(4);
const pgVectorTransformer = new VectorTransformer(768);

// ============================================================================
// 3. PHÂN HỆ 1: NGƯỜI DÙNG & XÁC THỰC (3 BẢNG)
// ============================================================================

@Entity('users')
@Check('chk_users_has_auth_method', `"password_hash" IS NOT NULL OR "google_id" IS NOT NULL`)
@Check('chk_users_email_lower', `"email" = LOWER("email")`)
export class User {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'email', type: 'varchar', length: 191, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ name: 'timezone', type: 'varchar', length: 64, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role_enum',
    default: UserRole.LEARNER,
  })
  role: UserRole;

  @Column({
    name: 'auth_provider',
    type: 'enum',
    enum: AuthProvider,
    enumName: 'auth_provider_enum',
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  @Column({ name: 'google_id', type: 'varchar', length: 100, unique: true, nullable: true })
  googleId: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => UserProfile, (profile) => profile.user)
  profile?: Relation<UserProfile>;

  @OneToOne(() => UserStreak, (streak) => streak.user)
  streak?: Relation<UserStreak>;

  @OneToOne(() => ReminderSetting, (setting) => setting.user)
  reminderSetting?: Relation<ReminderSetting>;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: Relation<RefreshToken[]>;

  @OneToMany(() => Deck, (deck) => deck.user)
  decks?: Relation<Deck[]>;
}

@Entity('user_profiles')
@Check('chk_profile_daily_target', `"daily_target_words" > 0`)
export class UserProfile {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int', unique: true })
  userId: number;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({
    name: 'target_level',
    type: 'enum',
    enum: CefrLevel,
    enumName: 'cefr_level_enum',
    default: CefrLevel.B1,
  })
  targetLevel: CefrLevel;

  @Column({ name: 'daily_target_words', type: 'int', default: 15 })
  dailyTargetWords: number;

  @Column({ name: 'strict_unlock_enabled', type: 'boolean', default: true })
  strictUnlockEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('refresh_tokens')
@Index('idx_refresh_user_state_expiry', ['userId', 'isRevoked', 'expiresAt'])
@Index('idx_refresh_expiry', ['expiresAt'])
@Check('chk_refresh_tokens_expiry', `"expires_at" > "created_at"`)
export class RefreshToken {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'is_revoked', type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// ============================================================================
// 4. PHÂN HỆ 2: TỪ ĐIỂN, BÀI HỌC LỘ TRÌNH & VECTOR RAG (5 BẢNG)
// ============================================================================

@Entity('topics')
export class Topic {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 120, unique: true })
  slug: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Vocabulary, (vocab) => vocab.topic)
  vocabularies?: Relation<Vocabulary[]>;

  @OneToMany(() => Deck, (deck) => deck.topic)
  decks?: Relation<Deck[]>;
}

@Entity('vocabularies')
@Unique('uq_vocab_natural_key', ['word', 'cefrLevel', 'partOfSpeech', 'senseNumber'])
@Index('idx_vocab_level_pos_active', ['cefrLevel', 'partOfSpeech', 'word'], {
  where: `"is_active" = TRUE`,
})
@Index('idx_vocab_topic_level_active', ['topicId', 'cefrLevel'], {
  where: `"is_active" = TRUE`,
})
@Index('idx_vocab_topic_id', ['topicId'])
@Check(
  'chk_vocab_part_of_speech',
  `"part_of_speech" IN ('n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'det.', 'exclam.', 'number', 'modal v.', 'article', 'indefinite article.', 'infinitive marker')`,
)
@Check('chk_vocab_sense_number', `"sense_number" >= 1`)
@Check('chk_vocab_stress', `"stress_syllable" IS NULL OR "stress_syllable" >= 1`)
export class Vocabulary {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'word', type: 'varchar', length: 100 })
  word: string;

  @Column({
    name: 'cefr_level',
    type: 'enum',
    enum: CefrLevel,
    enumName: 'cefr_level_enum',
  })
  cefrLevel: CefrLevel;

  @Column({ name: 'part_of_speech', type: 'varchar', length: 30 })
  partOfSpeech: OxfordPosTag;

  @Column({ name: 'sense_number', type: 'smallint', default: 1 })
  senseNumber: number;

  @Column({ name: 'phonetic', type: 'varchar', length: 100 })
  phonetic: string;

  @Column({ name: 'stress_syllable', type: 'smallint', nullable: true })
  stressSyllable: number | null;

  @Column({ name: 'audio_url', type: 'varchar', length: 500, nullable: true })
  audioUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'vietnamese_meaning', type: 'text' })
  vietnameseMeaning: string;

  @Column({ name: 'example_en', type: 'text' })
  exampleEn: string;

  @Column({ name: 'example_vi', type: 'text' })
  exampleVi: string;

  @Column({ name: 'topic_id', type: 'int' })
  topicId: number;

  @ManyToOne(() => Topic, (topic) => topic.vocabularies, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topic_id' })
  topic: Relation<Topic>;

  @OneToOne(() => VocabularyEmbedding, (emb) => emb.vocabulary)
  embedding?: Relation<VocabularyEmbedding>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('vocabulary_embeddings')
export class VocabularyEmbedding {
  @PrimaryColumn({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @OneToOne(() => Vocabulary, (vocab) => vocab.embedding, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Relation<Vocabulary>;

  /**
   * Cột pgvector(768) cho Gemini Embedding (text-embedding-004).
   * Lưu ý: Cột vật lý `vector(768)` và chỉ mục HNSW được tạo bởi SQL migration.
   */
  @Column({
    name: 'embedding',
    type: 'text',
    select: false,
    transformer: pgVectorTransformer,
    comment: 'Physical DDL type is vector(768) via pgvector migration',
  })
  embedding: number[];

  @Column({
    name: 'embedding_model',
    type: 'varchar',
    length: 100,
    default: 'text-embedding-004',
  })
  embeddingModel: string;

  @Column({ name: 'content_hash', type: 'char', length: 64 })
  contentHash: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('decks')
@Index('uq_decks_system_lesson_order', ['topicId', 'cefrLevel', 'orderIndex'], {
  unique: true,
  where: `"deck_type" = 'system_lesson' AND "deleted_at" IS NULL`,
})
@Index('idx_decks_type_public_level', ['deckType', 'isPublic', 'cefrLevel'], {
  where: `"deleted_at" IS NULL`,
})
@Index('idx_decks_user', ['userId'], {
  where: `"deleted_at" IS NULL`,
})
@Check(
  'chk_decks_kind',
  `("deck_type" = 'system_lesson' AND "user_id" IS NULL AND "topic_id" IS NOT NULL AND "order_index" IS NOT NULL AND "cefr_level" <> 'all' AND "deleted_at" IS NULL) OR ("deck_type" = 'custom_deck' AND "user_id" IS NOT NULL)`,
)
@Check('chk_decks_order_index', `"order_index" IS NULL OR "order_index" >= 1`)
@Check('chk_decks_total_cards', `"total_cards" >= 0`)
@Check('chk_decks_threshold', `"pass_score_threshold" BETWEEN 0.00 AND 100.00`)
export class Deck {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, (user) => user.decks, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User> | null;

  @Column({ name: 'topic_id', type: 'int', nullable: true })
  topicId: number | null;

  @ManyToOne(() => Topic, (topic) => topic.decks, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topic_id' })
  topic: Relation<Topic> | null;

  @Column({
    name: 'deck_type',
    type: 'enum',
    enum: DeckType,
    enumName: 'deck_type_enum',
    default: DeckType.CUSTOM_DECK,
  })
  deckType: DeckType;

  @Column({ name: 'order_index', type: 'int', nullable: true })
  orderIndex: number | null;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic: boolean;

  @Column({
    name: 'cefr_level',
    type: 'enum',
    enum: DeckCefrLevel,
    enumName: 'deck_cefr_level_enum',
    default: DeckCefrLevel.ALL,
  })
  cefrLevel: DeckCefrLevel;

  @Column({ name: 'total_cards', type: 'int', default: 0 })
  totalCards: number;

  @Column({
    name: 'pass_score_threshold',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '80.00',
    transformer: decimalScale2,
  })
  passScoreThreshold: number;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => DeckVocabulary, (dv) => dv.deck)
  deckVocabularies?: Relation<DeckVocabulary[]>;
}

@Entity('deck_vocabularies')
// SQL migration khai báo uq_deck_vocab_order dạng DEFERRABLE INITIALLY DEFERRED để kéo thả đổi thứ tự
@Unique('uq_deck_vocab_order', ['deckId', 'orderInLesson'])
@Index('idx_deck_vocab_vocabulary', ['vocabularyId'])
@Check('chk_deck_vocab_order', `"order_in_lesson" >= 1`)
export class DeckVocabulary {
  @PrimaryColumn({ name: 'deck_id', type: 'int' })
  deckId: number;

  @PrimaryColumn({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @ManyToOne(() => Deck, (deck) => deck.deckVocabularies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Relation<Deck>;

  @ManyToOne(() => Vocabulary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Relation<Vocabulary>;

  @Column({ name: 'order_in_lesson', type: 'int', default: 1 })
  orderInLesson: number;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt: Date;
}

// ============================================================================
// 5. PHÂN HỆ 3: TIẾN ĐỘ BÀI HỌC, SM-2 & LỊCH SỬ TRẢ LỜI (3 BẢNG)
// ============================================================================

@Entity('user_lesson_progress')
@Unique('uq_lesson_progress', ['userId', 'deckId'])
@Index('idx_user_lesson_progress_user', ['userId', 'isCompleted'])
@Check(
  'chk_lesson_progress_score',
  `"best_score" BETWEEN 0.00 AND 100.00 AND ("last_score" IS NULL OR "last_score" BETWEEN 0.00 AND 100.00) AND ("pass_threshold_snapshot" IS NULL OR "pass_threshold_snapshot" BETWEEN 0.00 AND 100.00)`,
)
@Check('chk_lesson_progress_attempts', `"attempts_count" >= 0`)
@Check(
  'chk_lesson_progress_completed',
  `NOT "is_completed" OR ("acquisition_completed" AND "first_completed_at" IS NOT NULL AND "pass_threshold_snapshot" IS NOT NULL AND "best_score" >= "pass_threshold_snapshot")`,
)
export class UserLessonProgress {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'deck_id', type: 'int' })
  deckId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Deck, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deck_id' })
  deck: Relation<Deck>;

  @Column({ name: 'acquisition_completed', type: 'boolean', default: false })
  acquisitionCompleted: boolean;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({
    name: 'best_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '0.00',
    transformer: decimalScale2,
  })
  bestScore: number;

  @Column({
    name: 'last_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalScale2,
  })
  lastScore: number | null;

  @Column({ name: 'attempts_count', type: 'int', default: 0 })
  attemptsCount: number;

  @Column({
    name: 'pass_threshold_snapshot',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalScale2,
  })
  passThresholdSnapshot: number | null;

  @Column({ name: 'first_completed_at', type: 'timestamptz', nullable: true })
  firstCompletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('user_vocabulary_progress')
@Unique('uq_progress_user_vocab', ['userId', 'vocabularyId'])
@Index('idx_user_sm2_due', ['userId', 'nextReviewDate'], {
  where: `"status" IN ('learning', 'reviewing')`,
})
@Check('chk_progress_leitner_box', `"leitner_box" BETWEEN 1 AND 5`)
@Check('chk_progress_repetitions', `"repetitions" >= 0`)
@Check('chk_progress_ease_factor', `"ease_factor" >= 1.3000`)
@Check('chk_progress_interval', `"interval_days" >= 0`)
@Check('chk_progress_counts', `"correct_count" >= 0 AND "incorrect_count" >= 0`)
@Check(
  'chk_progress_mastered',
  `"status" <> 'mastered' OR ("leitner_box" = 5 AND "interval_days" >= 21)`,
)
export class UserVocabularyProgress {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Vocabulary, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Relation<Vocabulary>;

  @Column({ name: 'leitner_box', type: 'smallint', default: 1 })
  leitnerBox: number;

  @Column({ name: 'repetitions', type: 'int', default: 0 })
  repetitions: number;

  @Column({
    name: 'ease_factor',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: '2.5000',
    transformer: decimalScale4,
  })
  easeFactor: number;

  @Column({ name: 'interval_days', type: 'int', default: 0 })
  intervalDays: number;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

  @Column({ name: 'next_review_date', type: 'date' })
  nextReviewDate: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ProgressStatus,
    enumName: 'progress_status_enum',
    default: ProgressStatus.NEW,
  })
  status: ProgressStatus;

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  @Column({ name: 'incorrect_count', type: 'int', default: 0 })
  incorrectCount: number;

  /** Cột sinh tự động GENERATED ALWAYS AS (correct_count + incorrect_count) STORED */
  @Column({
    name: 'total_reviews',
    type: 'int',
    generatedType: 'STORED',
    asExpression: `"correct_count" + "incorrect_count"`,
    insert: false,
    update: false,
  })
  totalReviews: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('review_logs')
@Index('idx_review_logs_session', ['sessionId'])
@Index('idx_review_logs_user_mistakes', ['userId', 'isCorrect', 'createdAt'])
@Index('idx_review_logs_user_vocab', ['userId', 'vocabularyId', 'createdAt'])
@Check('chk_review_quality', `"quality_rating" BETWEEN 0 AND 5`)
@Check('chk_review_correctness', `"is_correct" = ("quality_rating" >= 3)`)
@Check(
  'chk_review_distance',
  `"damerau_levenshtein_distance" IS NULL OR "damerau_levenshtein_distance" >= 0`,
)
@Check(
  'chk_review_grading_score',
  `("grading_status" = 'exact' AND "score" = 1.00) OR ("grading_status" = 'near_match' AND "score" = 0.50) OR ("grading_status" IN ('phonetic_match', 'incorrect') AND "score" = 0.00)`,
)
@Check('chk_review_response_time', `"response_time_ms" >= 0`)
export class ReviewLog {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @Column({ name: 'session_id', type: 'int', nullable: true })
  sessionId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Vocabulary, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Relation<Vocabulary>;

  @ManyToOne(() => StudySession, (session) => session.reviewLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'session_id' })
  session: Relation<StudySession> | null;

  @Column({
    name: 'practice_mode',
    type: 'enum',
    enum: PracticeMode,
    enumName: 'practice_mode_enum',
  })
  practiceMode: PracticeMode;

  @Column({ name: 'user_answer', type: 'text', nullable: true })
  userAnswer: string | null;

  @Column({ name: 'question_payload', type: 'jsonb', nullable: true })
  questionPayload: Record<string, unknown> | null;

  @Column({
    name: 'grading_status',
    type: 'enum',
    enum: GradingStatus,
    enumName: 'grading_status_enum',
  })
  gradingStatus: GradingStatus;

  @Column({
    name: 'score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    transformer: decimalScale2,
  })
  score: number;

  @Column({ name: 'is_correct', type: 'boolean' })
  isCorrect: boolean;

  @Column({ name: 'damerau_levenshtein_distance', type: 'int', nullable: true })
  damerauLevenshteinDistance: number | null;

  @Column({ name: 'soundex_matched', type: 'boolean', nullable: true })
  soundexMatched: boolean | null;

  @Column({ name: 'quality_rating', type: 'smallint' })
  qualityRating: number;

  @Column({ name: 'response_time_ms', type: 'int', default: 0 })
  responseTimeMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// ============================================================================
// 6. PHÂN HỆ 4: PHIÊN LUYỆN TẬP (1 BẢNG)
// ============================================================================

@Entity('study_sessions')
@Index('idx_study_sessions_user_start', ['userId', 'startTime'])
@Check(
  'chk_session_counts',
  `"total_questions" >= 0 AND "correct_answers" >= 0 AND "correct_answers" <= "total_questions"`,
)
@Check('chk_session_score', `"total_score" >= 0.00 AND "total_score" <= "total_questions"`)
@Check('chk_session_percentage', `"score_percentage" BETWEEN 0.00 AND 100.00`)
@Check('chk_session_xp', `"xp_earned" >= 0`)
@Check('chk_session_time', `"end_time" IS NULL OR "end_time" >= "start_time"`)
export class StudySession {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'deck_id', type: 'int', nullable: true })
  deckId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Deck, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deck_id' })
  deck: Relation<Deck> | null;

  @Column({
    name: 'session_type',
    type: 'enum',
    enum: SessionType,
    enumName: 'session_type_enum',
    default: SessionType.LESSON_PRACTICE,
  })
  sessionType: SessionType;

  @Column({ name: 'start_time', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ name: 'total_questions', type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correctAnswers: number;

  @Column({
    name: 'total_score',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: '0.00',
    transformer: decimalScale2,
  })
  totalScore: number;

  @Column({
    name: 'score_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '0.00',
    transformer: decimalScale2,
  })
  scorePercentage: number;

  @Column({ name: 'xp_earned', type: 'int', default: 0 })
  xpEarned: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ReviewLog, (log) => log.session)
  reviewLogs?: Relation<ReviewLog[]>;
}

// ============================================================================
// 7. PHÂN HỆ 5: TRÒ CHƠI HÓA & NHẮC NHỞ TỰ ĐỘNG (5 BẢNG)
// ============================================================================

@Entity('user_streaks')
@Index('idx_leaderboard_streak', ['currentStreak', 'longestStreak'])
@Check(
  'chk_streaks_non_neg',
  `"current_streak" >= 0 AND "longest_streak" >= 0 AND "freeze_streak_count" >= 0`,
)
@Check('chk_streaks_longest', `"longest_streak" >= "current_streak"`)
export class UserStreak {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int', unique: true })
  userId: number;

  @OneToOne(() => User, (user) => user.streak, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'current_streak', type: 'int', default: 0 })
  currentStreak: number;

  @Column({ name: 'longest_streak', type: 'int', default: 0 })
  longestStreak: number;

  @Column({ name: 'last_study_date', type: 'date', nullable: true })
  lastStudyDate: string | null;

  @Column({ name: 'freeze_streak_count', type: 'int', default: 0 })
  freezeStreakCount: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('daily_activities')
@Unique('uq_daily_activity', ['userId', 'activityDate'])
@Check(
  'chk_activity_counts',
  `"words_learned" >= 0 AND "words_reviewed" >= 0 AND "questions_answered" >= 0 AND "correct_answers" >= 0 AND "correct_answers" <= "questions_answered" AND "study_seconds" >= 0 AND "total_xp" >= 0`,
)
@Check('chk_activity_target_positive', `"target_words_snapshot" > 0`)
@Check(
  'chk_activity_target_met',
  `"is_target_met" = ("words_learned" >= "target_words_snapshot")`,
)
export class DailyActivity {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'activity_date', type: 'date' })
  activityDate: string;

  @Column({ name: 'words_learned', type: 'int', default: 0 })
  wordsLearned: number;

  @Column({ name: 'words_reviewed', type: 'int', default: 0 })
  wordsReviewed: number;

  @Column({ name: 'questions_answered', type: 'int', default: 0 })
  questionsAnswered: number;

  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ name: 'study_seconds', type: 'int', default: 0 })
  studySeconds: number;

  @Column({ name: 'total_xp', type: 'int', default: 0 })
  totalXp: number;

  @Column({ name: 'target_words_snapshot', type: 'int' })
  targetWordsSnapshot: number;

  @Column({ name: 'is_target_met', type: 'boolean', default: false })
  isTargetMet: boolean;

  @Column({ name: 'timezone_used', type: 'varchar', length: 64 })
  timezoneUsed: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('badges')
@Check('chk_badge_condition_value', `"condition_value" > 0`)
export class Badge {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'code', type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'icon_key', type: 'varchar', length: 100 })
  iconKey: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string | null;

  @Column({
    name: 'condition_type',
    type: 'enum',
    enum: BadgeConditionType,
    enumName: 'badge_condition_type_enum',
  })
  conditionType: BadgeConditionType;

  @Column({ name: 'condition_value', type: 'int' })
  conditionValue: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

@Entity('user_badges')
@Unique('uq_user_badge', ['userId', 'badgeId'])
@Index('idx_user_badges_user_earned', ['userId', 'earnedAt'])
export class UserBadge {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'badge_id', type: 'int' })
  badgeId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @ManyToOne(() => Badge, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'badge_id' })
  badge: Relation<Badge>;

  @CreateDateColumn({ name: 'earned_at', type: 'timestamptz' })
  earnedAt: Date;
}

@Entity('reminder_settings')
@Index('idx_reminder_email_due', ['nextEmailReminderAtUtc'], {
  where: `"email_reminder_enabled" = TRUE`,
})
@Index('idx_reminder_streak_due', ['nextStreakWarningAtUtc'], {
  where: `"is_warning_streak_enabled" = TRUE`,
})
@Index('idx_reminder_inactivity_enabled', ['lastInactivityRemindedAt'], {
  where: `"is_inactivity_reminder_enabled" = TRUE`,
})
export class ReminderSetting {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int', unique: true })
  userId: number;

  @OneToOne(() => User, (user) => user.reminderSetting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'email_reminder_enabled', type: 'boolean', default: true })
  emailReminderEnabled: boolean;

  @Column({ name: 'reminder_time', type: 'time', default: '20:00:00' })
  reminderTime: string;

  @Column({ name: 'is_warning_streak_enabled', type: 'boolean', default: true })
  isWarningStreakEnabled: boolean;

  @Column({ name: 'is_inactivity_reminder_enabled', type: 'boolean', default: true })
  isInactivityReminderEnabled: boolean;

  @Column({ name: 'next_email_reminder_at_utc', type: 'timestamptz', nullable: true })
  nextEmailReminderAtUtc: Date | null;

  @Column({ name: 'next_streak_warning_at_utc', type: 'timestamptz', nullable: true })
  nextStreakWarningAtUtc: Date | null;

  @Column({ name: 'last_email_reminded_date', type: 'date', nullable: true })
  lastEmailRemindedDate: string | null;

  @Column({ name: 'last_streak_warning_date', type: 'date', nullable: true })
  lastStreakWarningDate: string | null;

  @Column({ name: 'last_inactivity_reminded_at', type: 'timestamptz', nullable: true })
  lastInactivityRemindedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

// ============================================================================
// 8. PHÂN HỆ 6: HỘI THOẠI (TRỢ LÝ AI LEVEL 2 & HỖ TRỢ ADMIN) (2 BẢNG)
// ============================================================================

@Entity('chat_conversations')
@Index('idx_chat_user_updated', ['userId', 'updatedAt'])
@Index('idx_chat_support_queue', ['status', 'updatedAt'], {
  where: `"type" = 'admin_support'`,
})
@Check('chk_chat_admin_only', `"assigned_admin_id" IS NULL OR "type" = 'admin_support'`)
export class ChatConversation {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ChatType,
    enumName: 'chat_type_enum',
    default: ChatType.AI_ASSISTANT,
  })
  type: ChatType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ChatStatus,
    enumName: 'chat_status_enum',
    default: ChatStatus.OPEN,
  })
  status: ChatStatus;

  @Column({ name: 'assigned_admin_id', type: 'int', nullable: true })
  assignedAdminId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_admin_id' })
  assignedAdmin: Relation<User> | null;

  @Column({
    name: 'title',
    type: 'varchar',
    length: 200,
    default: 'Cuộc trò chuyện mới',
  })
  title: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ChatMessage, (msg) => msg.conversation)
  messages?: Relation<ChatMessage[]>;
}

@Entity('chat_messages')
@Index('idx_chat_messages_page', ['conversationId', 'createdAt', 'id'])
@Check('chk_chat_tokens', `"tokens_used" IS NULL OR "tokens_used" >= 0`)
@Check('chk_chat_sender_user', `"sender" <> 'assistant' OR "sender_user_id" IS NULL`)
export class ChatMessage {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'conversation_id', type: 'int' })
  conversationId: number;

  @ManyToOne(() => ChatConversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Relation<ChatConversation>;

  @Column({
    name: 'sender',
    type: 'enum',
    enum: ChatSender,
    enumName: 'chat_sender_enum',
  })
  sender: ChatSender;

  @Column({ name: 'sender_user_id', type: 'int', nullable: true })
  senderUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser: Relation<User> | null;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'related_vocabulary_id', type: 'int', nullable: true })
  relatedVocabularyId: number | null;

  @ManyToOne(() => Vocabulary, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_vocabulary_id' })
  relatedVocabulary: Relation<Vocabulary> | null;

  @Column({
    name: 'feedback_type',
    type: 'enum',
    enum: AiFeedbackType,
    enumName: 'ai_feedback_type_enum',
    default: AiFeedbackType.GENERAL,
  })
  feedbackType: AiFeedbackType;

  @Column({ name: 'tool_calls', type: 'jsonb', nullable: true })
  toolCalls: AiToolCallRecord[] | null;

  @Column({ name: 'tokens_used', type: 'int', nullable: true })
  tokensUsed: number | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// ============================================================================
// 9. TỔNG HỢP 19 ENTITIES CHO TYPEORM MODULE
// ============================================================================

export const ALL_ENTITIES = [
  User,
  UserProfile,
  RefreshToken,
  Topic,
  Vocabulary,
  VocabularyEmbedding,
  Deck,
  DeckVocabulary,
  UserLessonProgress,
  UserVocabularyProgress,
  ReviewLog,
  StudySession,
  UserStreak,
  DailyActivity,
  Badge,
  UserBadge,
  ReminderSetting,
  ChatConversation,
  ChatMessage,
] as const;
