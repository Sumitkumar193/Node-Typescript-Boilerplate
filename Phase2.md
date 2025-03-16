# Phase 2: E-Commerce Functionality

This phase focuses on implementing e-commerce functionality including product management and order processing.

## Database Schema

The schema has been extended to include:
- Products
- Orders
- OrderItems

```prisma
model Product {
  id          String      @id @default(cuid())
  name        String
  description String?
  price       Float
  stock       Int
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  orderItems  OrderItem[]

  @@index([name])
  @@map("products")
}

enum OrderStatus {
  PENDING
  PROCESSING
  COMPLETED
  CANCELLED
}

model Order {
  id          String      @id @default(cuid())
  userId      String
  status      OrderStatus @default(PENDING)
  totalAmount Float
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  items       OrderItem[]

  @@index([userId])
  @@map("orders")
}

model OrderItem {
  id            String   @id @default(cuid())
  orderId       String
  productId     String
  quantity      Int
  purchasePrice Float
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  order         Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product       Product  @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([orderId])
  @@index([productId])
  @@map("order_items")
}
```

## API Endpoints

### Products

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/products` | List all products | Public |
| GET | `/api/products/:id` | Get a product by ID | Public |
| POST | `/api/products` | Create a new product | Admin |
| PUT | `/api/products/:id` | Update a product | Admin |
| PATCH | `/api/products/:id/stock` | Update product stock | Admin, Moderator |
| DELETE | `/api/products/:id` | Delete a product | Admin |

### Orders

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/orders` | List user orders (all for Admin) | User (own), Admin (all) |
| GET | `/api/orders/:id` | Get an order by ID | User (own), Admin, Moderator |
| POST | `/api/orders` | Create a new order | User |
| PUT | `/api/orders/:id` | Update order status | Admin, Moderator |
| DELETE | `/api/orders/:id` | Delete an order | Admin |

## Features

### Product Management
- Full CRUD operations for products
- Search and pagination for product listings
- Stock management

### Order Processing
- Create orders with multiple products
- Automatic stock reduction on order creation
- Order status management (PENDING, PROCESSING, COMPLETED, CANCELLED)
- Order history for users

## Implementation Details

### Product Controller
The `ProductController` implements:
- Product listing with search and pagination
- Product creation with validation
- Product updates, including specialized stock updates
- Product deletion with appropriate permissions

### Order Controller
The `OrderController` implements:
- Order creation with automatic stock reduction
- Order listing with role-based filtering (users see only their orders)
- Order details with product information
- Order status updates with validation
- Order deletion with appropriate permissions

## Role-Based Access Control

Access to various features is controlled by user roles:
- **Admin**: Full access to all products and orders
- **Moderator**: Can update product stock and order status
- **User**: Can view products, create orders, and view their own orders

## Schema Changes

The User model has been updated to include a relation to orders:
```prisma
model User {
  // ...existing fields...
  Order         Order[]
}
```

## Testing

API endpoints can be tested using the included Postman collection: `woro.postman_collection`.

Requests for Phase 2:
- Create Product
- List Products
- Update Product
- Create Order
- View Order Details
- Update Order Status
