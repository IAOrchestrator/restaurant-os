import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type ReviewId = string;

export class Review extends Entity<ReviewId> {
  private constructor(
    id: ReviewId,
    public readonly restaurantId: string,
    public readonly customerId: string,
    private _rating: number,
    private _comment: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: ReviewId;
    restaurantId: string;
    customerId: string;
    rating: number;
    comment?: string | null;
    createdAt?: Date;
  }): Result<Review, ReviewDomainError> {
    if (props.rating < 1 || props.rating > 5 || !Number.isInteger(props.rating)) {
      return err(new ReviewDomainError('Rating must be an integer between 1 and 5'));
    }

    const comment = props.comment ? props.comment.trim() : null;
    if (comment && comment.length > 2000) {
      return err(new ReviewDomainError('Comment must be at most 2000 characters'));
    }

    const now = props.createdAt ?? new Date();
    return ok(
      new Review(
        props.id,
        props.restaurantId,
        props.customerId,
        props.rating,
        comment,
        now,
        now,
      ),
    );
  }

  get rating(): number {
    return this._rating;
  }

  get comment(): string | null {
    return this._comment;
  }

  update(props: {
    rating?: number;
    comment?: string | null;
  }): Result<Review, ReviewDomainError> {
    if (props.rating !== undefined) {
      if (props.rating < 1 || props.rating > 5 || !Number.isInteger(props.rating)) {
        return err(new ReviewDomainError('Rating must be an integer between 1 and 5'));
      }
    }

    const newComment = props.comment !== undefined
      ? (props.comment ? props.comment.trim() : null)
      : this._comment;

    if (newComment && newComment.length > 2000) {
      return err(new ReviewDomainError('Comment must be at most 2000 characters'));
    }

    return ok(
      new Review(
        this.id,
        this.restaurantId,
        this.customerId,
        props.rating !== undefined ? props.rating : this._rating,
        newComment,
        this.createdAt,
        new Date(),
      ),
    );
  }
}

export class ReviewDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewDomainError';
  }
}
