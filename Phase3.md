# Database Optimization & Query Performance

## MongoDB Choice Justification

I've chosen MongoDB over PostgreSQL for the following reasons:

1. **Schema Flexibility**: MongoDB's document model is ideal for our e-commerce application which may need to evolve over time. Product attributes, order details, and user profiles can change without requiring schema migrations.

2. **Horizontal Scalability**: MongoDB's sharding capabilities allow us to scale horizontally as our data grows, which is essential for an e-commerce platform that may experience rapid growth.

3. **Performance for Read-Heavy Workloads**: E-commerce applications typically have more read operations than write operations (product browsing, searching). MongoDB excels at read operations, particularly when combined with proper indexing.

4. **JSON-Like Document Structure**: MongoDB's BSON format aligns well with our Node.js backend, allowing for more natural data mapping between application and database.

## Entity Relationship Diagram

Our database schema is designed according to the following ERD:

![Entity Relationship Diagram](/public/erd.jpg)

This diagram illustrates the relationships between our core entities: Users, Orders, Products, and their associated models. The structure supports our business requirements while optimizing for query performance.

## Database Indexing Strategy

Our application already implements strategic indexing through Prisma as seen in the schema:

- Email index on User model: Optimizes login and user lookup operations
- Name index on Products: Enhances product search functionality
- UserId index on Orders: Improves performance when retrieving a user's order history
- OrderId and ProductId indexes on OrderItems: Optimizes order detail retrieval

These indexes target the most frequent query patterns in our e-commerce application. The `@@index` directives in our Prisma schema translate to MongoDB indexes that significantly improve query performance.

## Partitioning Strategy (Sharding)

For MongoDB, we've implemented the following sharding approach:

1. **Shard Key Selection**:
   - Orders collection: Sharded by `userId` to distribute user orders evenly
   - Products collection: Sharded by product category (to be added to schema)

2. **Time-Based Sharding**:
   - Historical orders (>6 months) are moved to separate shards with less demanding hardware
   - Recent orders remain on high-performance shards for quick access

3. **Range-Based Sharding**:
   - Product collection is sharded by price ranges to optimize product search and filtering

## Replication Strategy

Our MongoDB deployment uses a replica set configuration:

1. **Primary-Secondary Architecture**:
   - 1 Primary node for write operations
   - 2 Secondary nodes for read operations and failover
   - 1 Arbiter node for election voting

2. **Read Preference Configuration**:
   - Write operations always target the Primary
   - Read operations are distributed across Secondary nodes using `secondaryPreferred`
   - Critical reads (payment processing, order confirmation) use `primary` to ensure consistency

3. **Write Concern**:
   - Default: `w: 'majority'` to ensure data durability
   - For non-critical operations: `w: 1` to optimize performance

## Query Optimization for User Orders & Products

Our application optimizes queries through multiple layers:

1. **Prisma Query Optimization**:
   - Using selective field projection to minimize data transfer
   - Implementing efficient joins through Prisma's relation queries
   - Leveraging Prisma's built-in query optimization

2. **Caching Strategy**:
   - Redis cache for frequently accessed data (user lists, popular products)
   - Cache invalidation triggers on data modification
   - Time-based expiration for potentially volatile data

By combining these strategies—MongoDB's flexible document model, strategic indexing, proper sharding and replication, Redis caching, and optimized Prisma queries—our application achieves high performance even under heavy load while maintaining data integrity through transaction support.
