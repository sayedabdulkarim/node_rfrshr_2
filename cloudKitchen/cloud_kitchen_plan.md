# Cloud Kitchen Food Delivery App - Sambalpur

## Project Overview
Own cloud kitchen + delivery app for Sambalpur, Odisha. Compete with Swiggy/Zomato locally.

---

## Requirements Summary
- **Features:** Menu, Cart, Order, Payment, Order History, Live Tracking, Notifications
- **Delivery:** Own delivery boys (in-house fleet)
- **Payments:** UPI (PhonePe/Paytm/GooglePay) + COD
- **Tech Stack:** MERN + React Native

---

## Architecture

### 3 Apps Needed:
```
1. Customer App (React Native)     - Order food, track delivery
2. Delivery Boy App (React Native) - Accept orders, update location
3. Admin Panel (React Web)         - Manage menu, orders, delivery boys
```

### Backend:
```
Node.js + Express + MongoDB + Socket.io (real-time tracking)
```

---

## Database Schema (MongoDB Collections)

### 1. Users
```javascript
{
  _id, name, phone, email,
  addresses: [{ label, address, lat, lng }],
  fcmToken,  // for push notifications
  createdAt, updatedAt
}
```

### 2. Menu Items
```javascript
{
  _id, name, description, price,
  category: "Veg/Non-Veg/Drinks",
  image, isAvailable,
  preparationTime,  // in minutes
  createdAt, updatedAt
}
```

### 3. Orders
```javascript
{
  _id,
  user: ObjectId,
  items: [{ menuItem, quantity, price }],
  totalAmount,
  deliveryAddress: { address, lat, lng },
  paymentMethod: "UPI/COD",
  paymentStatus: "pending/paid",
  orderStatus: "placed/confirmed/preparing/ready/picked/delivered/cancelled",
  deliveryBoy: ObjectId,
  otp: "4-digit",  // delivery verification
  estimatedDelivery,
  createdAt, updatedAt
}
```

### 4. Delivery Boys
```javascript
{
  _id, name, phone,
  isAvailable: true/false,
  currentLocation: { lat, lng },
  fcmToken,
  activeOrder: ObjectId,
  createdAt, updatedAt
}
```

### 5. Transactions (Payment tracking)
```javascript
{
  _id, order: ObjectId,
  amount, method: "UPI/COD",
  upiId,  // if UPI payment
  status: "pending/success/failed",
  createdAt
}
```

---

## API Endpoints

### Auth
```
POST /api/auth/send-otp        - Send OTP to phone
POST /api/auth/verify-otp      - Verify & login
GET  /api/auth/me              - Get current user
```

### Menu
```
GET  /api/menu                 - Get all menu items
GET  /api/menu/:category       - Get by category
```

### Orders (Customer)
```
POST /api/orders               - Place new order
GET  /api/orders               - Get my orders
GET  /api/orders/:id           - Get order details
POST /api/orders/:id/cancel    - Cancel order
```

### Orders (Delivery Boy)
```
GET  /api/delivery/orders      - Get assigned orders
PUT  /api/delivery/orders/:id/status  - Update status
PUT  /api/delivery/location    - Update current location
POST /api/delivery/verify-otp  - Verify delivery OTP
```

### Admin
```
GET/POST/PUT/DELETE /api/admin/menu      - Manage menu
GET  /api/admin/orders                    - All orders
PUT  /api/admin/orders/:id/assign        - Assign delivery boy
GET  /api/admin/delivery-boys            - All delivery boys
GET  /api/admin/dashboard                - Stats & analytics
```

---

## Real-Time Tracking (Socket.io)

```javascript
// Events
'delivery-location-update'  - Delivery boy sends location every 10 sec
'order-status-update'       - Order status changes
'new-order'                 - Admin/Delivery boy gets new order alert
```

### Flow:
```
1. Customer places order → Admin gets notification
2. Admin confirms → Kitchen starts preparing
3. Admin assigns delivery boy → Delivery boy gets notification
4. Delivery boy picks up → Customer sees live location
5. Delivery boy reaches → Enters OTP → Order completed
```

---

## Payment Integration

### Option 1: UPI Intent (Recommended for MVP)
```javascript
// Generate UPI deep link
const upiLink = `upi://pay?pa=${YOUR_UPI_ID}&pn=CloudKitchen&am=${amount}&cu=INR&tn=Order${orderId}`;

// Open in PhonePe/GPay/Paytm
Linking.openURL(upiLink);
```

### Option 2: Razorpay UPI (Later - for auto verification)
- Razorpay handles UPI, auto-confirms payment
- 2% transaction fee

### COD Flow:
- Order placed → Payment status = "pending"
- Delivery boy collects cash → Marks as "paid"
- Daily settlement with delivery boys

---

## Push Notifications (Firebase FCM)

### Customer Notifications:
- Order confirmed
- Order being prepared
- Delivery boy assigned
- Out for delivery
- Delivered

### Delivery Boy Notifications:
- New order assigned
- Order ready for pickup

---

## Folder Structure

```
sambalpur-food-app/
│
├── server/                    # Backend
│   ├── config/
│   │   ├── db.js
│   │   └── firebase.js        # FCM config
│   ├── models/
│   │   ├── User.js
│   │   ├── MenuItem.js
│   │   ├── Order.js
│   │   ├── DeliveryBoy.js
│   │   └── Transaction.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── socket/
│   │   └── index.js           # Socket.io handlers
│   ├── utils/
│   │   ├── sendOtp.js
│   │   └── sendNotification.js
│   └── server.js
│
├── customer-app/              # React Native - Customer
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Home.js
│   │   │   ├── Menu.js
│   │   │   ├── Cart.js
│   │   │   ├── Checkout.js
│   │   │   ├── OrderTracking.js
│   │   │   └── OrderHistory.js
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/
│   │   └── navigation/
│   └── App.js
│
├── delivery-app/              # React Native - Delivery Boy
│   ├── src/
│   │   ├── screens/
│   │   │   ├── Home.js
│   │   │   ├── ActiveOrder.js
│   │   │   ├── Navigation.js  # Google Maps
│   │   │   └── History.js
│   │   └── ...
│   └── App.js
│
└── admin-panel/               # React Web - Admin
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.js
    │   │   ├── Orders.js
    │   │   ├── Menu.js
    │   │   ├── DeliveryBoys.js
    │   │   └── Reports.js
    │   └── ...
    └── package.json
```

---

## Development Phases

### Phase 1: MVP (4-6 weeks)
- [ ] Backend setup + Auth (OTP login)
- [ ] Menu CRUD
- [ ] Order flow (place, confirm, deliver)
- [ ] Customer app (Menu, Cart, Order)
- [ ] Admin panel (basic)
- [ ] COD only

### Phase 2: Tracking + Payments (2-3 weeks)
- [ ] Socket.io live tracking
- [ ] Delivery boy app
- [ ] UPI payment integration
- [ ] Push notifications

### Phase 3: Polish (2 weeks)
- [ ] Order history
- [ ] Admin dashboard analytics
- [ ] Testing & bug fixes
- [ ] Play Store deployment

### Phase 4: Future (Later)
- [ ] Promo codes / Discounts
- [ ] Loyalty points
- [ ] Reviews & ratings
- [ ] Multiple kitchen support

---

## Cost Estimates

### Development:
- If you build yourself: FREE (time investment)
- If outsourced: ₹50K - ₹1.5L

### Recurring Costs:
- Server (DigitalOcean/AWS): ₹1000-2000/month
- MongoDB Atlas (free tier initially): FREE
- Firebase (notifications): FREE (up to limits)
- SMS OTP (MSG91): ₹0.20/OTP
- Domain: ₹500-1000/year
- Play Store: ₹2000 one-time

### Total Monthly: ~₹2000-3000 initially

---

## Business Decisions (Finalized)

| Setting | Value |
|---------|-------|
| Brand Name | TBD (decide later) |
| Delivery Area | Full Sambalpur city |
| Minimum Order | No minimum |
| Delivery Charges | TBD (suggest: Free above ₹199, else ₹20-30) |

---

## Next Steps

1. **Decide brand name** - Important for app branding
2. **Setup development environment**
3. **Start with backend** - Auth + Menu + Orders
4. **Build customer app MVP**
5. **Test locally with COD**
6. **Add UPI + Tracking + Notifications**
7. **Build delivery boy app**
8. **Admin panel**
9. **Testing & Launch**

---

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Customer App | React Native |
| Delivery App | React Native |
| Admin Panel | React.js |
| Notifications | Firebase FCM |
| Maps | Google Maps API |
| Payments | UPI Intent + COD |
| OTP | MSG91 / Twilio |
| Hosting | DigitalOcean / AWS |

---

## Ready to Build! 🚀
