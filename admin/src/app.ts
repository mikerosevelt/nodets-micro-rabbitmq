import express, { Request, Response } from 'express';
import cors from 'cors';
import { createConnection } from 'typeorm';
import { Product } from './entity/product';
import amqp from 'amqplib/callback_api';

createConnection().then(db => {
  const productRepository = db.getRepository(Product);

  amqp.connect('', (error0, connection) => {
    if (error0) {
      throw error0;
    }

    connection.createChannel((error1, channel) => {
      if (error1) {
        throw error1;
      }

      const app = express();

      app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:4200']
      }));

      app.use(express.json());

      // Get all products
      app.get('/api/products', async (req: Request, res: Response) => {
        const products = await productRepository.find();
        channel.sendToQueue('hello', Buffer.from('hello'));
        res.json(products);
      });

      // Get single product
      app.get('/api/products/:id', async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);

        res.json(product);
      });

      // Add a product
      app.post('/api/products', async (req: Request, res: Response) => {
        const product = await productRepository.create(req.body);
        const result = await productRepository.save(product);
        channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)));
        res.json(result);
      });

      // Update a product
      app.put('/api/products/:id', async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        productRepository.merge(product, req.body);
        const result = await productRepository.save(product);
        channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)));
        res.json(result);
      });

      // Delete a product
      app.delete('/api/products/:id', async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);

        if (!product) {
          return res.status(404).send('Product not found!');
        }

        await productRepository.delete(req.params.id);
        channel.sendToQueue('product_deleted', Buffer.from(req.params.id));

        res.json({});
      });

      // Like a product
      app.post('/api/products/:id/like', async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        product.likes++;
        const result = await productRepository.save(product);
        res.json(result);
      });


      app.listen(5000, () => {
        console.log('Server running on port 5000');
      });
      process.on('beforeExit', () => {
        console.log('closing');
        connection.close();
      });

    });
  });
});