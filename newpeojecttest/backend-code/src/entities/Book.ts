import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid', { name: 'book_id' })
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  author: string;

  @Column({ type: 'varchar', unique: true })
  isbn: string;

  @Column({
    type: 'enum',
    enum: ['available', 'borrowed'],
    default: 'available'
  })
  status: 'available' | 'borrowed';
}