import express, { Request, Response } from 'express';
import cors from 'cors';
import { createConnection } from 'typeorm';
import amqp from 'amqplib/callback_api';
import { Product } from './entity/product';

createConnection().then(db => {
  const productRepository = db.getMongoRepository(Product);
  amqp.connect('amqps://pvcbecxw:fKZHk7qwm-kZsa-6KQDAZS-U7UUSq7FO@hornet.rmq.cloudamqp.com/pvcbecxw', (error0, connection) => {
    if (error0) {
      throw error0;
    }

    connection.createChannel((error1, channel) => {
      if (error1) {
        throw error1;
      }

      channel.assertQueue('product_created', { durable: false });
      channel.assertQueue('product_updated', { durable: false });
      channel.assertQueue('product_deleted', { durable: false });

      const app = express();

      app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:4200']
      }));

      app.use(express.json());

      channel.consume('product_created', async (msg) => {
        try {
          const eventProduct: Product = JSON.parse(msg.content.toString());
          const product = new Product();
          product.admin_id = parseInt(eventProduct.id);
          product.title = eventProduct.title;
          product.image = eventProduct.image;
          product.likes = eventProduct.likes;
          await productRepository.save(product);
          console.log('product created');
        } catch (error) {
          console.log(error);
        }
      }, { noAck: true });

      channel.consume('product_updated', async (msg) => {
        try {

          const eventProduct: Product = JSON.parse(msg.content.toString());
          const product = await productRepository.findOne({ admin_id: parseInt(eventProduct.id) });
          productRepository.merge(product, { title: eventProduct.title, image: eventProduct.image, likes: eventProduct.likes });
          await productRepository.save(product);
          console.log('product updated');
        } catch (error) {
          console.log(error);
        }
      }, { noAck: true });

      channel.consume('product_deleted', async (msg) => {
        try {
          const admin_id = parseInt(msg.content.toString());
          await productRepository.deleteOne({ admin_id });
          console.log('product deleted');
        } catch (error) {
          console.log(error);
        }
      });

      app.get('/api/products', async (req: Request, res: Response) => {
        try {
          const products = await productRepository.find();

          return res.send(products);
        } catch (error) {
          console.log(error);
        }

      });

      app.listen(5001, () => {
        console.log('Server running on port 5001');
      });

      process.on('beforeExit', () => {
        console.log('closing');
        connection.close();
      });

    });
  });
});
