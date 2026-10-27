import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Book } from './Book';

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid', { name: 'loan_id' })
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Book)
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @CreateDateColumn({ type: 'timestamp', name: 'borrow_date' })
  borrowDate: Date;

  @Column({ type: 'timestamp', name: 'due_date' })
  dueDate: Date;

  @Column({ type: 'timestamp', name: 'return_date', nullable: true })
  returnDate: Date | null;
}