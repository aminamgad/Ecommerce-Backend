import mongoose from 'mongoose';
import { env } from './env';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { Cart } from '../models/Cart';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  console.log('mongo db connected');

  await Promise.all([
    User.syncIndexes(),
    Category.syncIndexes(),
    Product.syncIndexes(),
    Cart.syncIndexes(),
  ]);
}
