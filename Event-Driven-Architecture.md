# Event-Driven Architecture with RabbitMQ

> A complete guide to understanding why RabbitMQ exists, what problem it solves, and how it powers modern microservices at scale.

---

## Table of Contents

- [The Problem — A Restaurant Analogy](#the-problem--a-restaurant-analogy)
- [How RabbitMQ Fixes This](#how-rabbitmq-fixes-this)
- [What Each Service Does](#what-each-service-does)
- [Why Not Save Directly to MongoDB?](#why-not-save-directly-to-mongodb)
- [Why RabbitMQ Solves This](#why-rabbitmq-solves-this)
- [The Other Benefit — Resilience](#the-other-benefit--resilience)
- [Simple Analogy](#simple-analogy)
- [Why Two Separate Services?](#why-two-separate-services-worker--service)
- [RabbitMQ vs Kafka](#rabbitmq-vs-kafka--what-is-the-difference)
- [Why Not Just Poll the API or Use WebSockets?](#why-not-just-poll-the-api-or-use-websockets)
- [Why Event-Driven Architecture](#why-event-driven-architecture)
- [Real World Companies Using This](#real-world-companies-using-this)
- [One Line Summary](#one-line-summary)

---

## The Problem — A Restaurant Analogy

Imagine you own a very popular restaurant. Your restaurant gets **10,000 customers a day**.

### Without a Queue System

```
Customer walks in
  → Waiter takes order
  → Waiter runs to kitchen
  → Waiter waits for chef to finish
  → Waiter runs back to customer
  → Customer gets food
```

This works fine for 10 customers. What happens with **10,000 customers at the same time?**

```
  → Waiters are stuck waiting in kitchen
  → New customers are standing at door
  → Everything slows down
  → Customers leave angry
```

### In Tech Terms

```
User clicks short URL
  → url-service handles request
  → url-service writes to MongoDB     (waits 50ms)
  → url-service writes to PostgreSQL  (waits 30ms)
  → url-service finally redirects user
```

Fine for 10 users. **10,000 users clicking at the same time?**

```
  → Every user waits 80ms extra
  → Servers get overwhelmed
  → Website crashes
```

---

## How RabbitMQ Fixes This

Think of RabbitMQ as a **ticket machine** in a restaurant.

```
Customer walks in
  → Waiter takes order
  → Waiter drops ticket in machine   ← takes 1 second
  → Waiter goes back to next customer immediately
  → Kitchen picks up tickets and cooks at their own pace

10,000 customers?
  → Waiters never get stuck
  → Tickets pile up in machine
  → Kitchen works through them steadily
  → Everyone gets served
```

### In Tech Terms

```
User clicks short URL
  → url-service handles request
  → url-service drops message in RabbitMQ  ← takes 1ms
  → url-service redirects user immediately
  → analytics-worker picks up message later
  → writes to MongoDB at its own pace

10,000 users clicking at the same time?
  → Every redirect is still instant
  → Messages queue up safely
  → analytics-worker drains the queue
  → No data lost, no slowdown
```

---

## What Each Service Does

```
url-service         → handles redirects (GET /:shortcode)
                      this is the HOT PATH — gets hit millions of times

analytics-worker    → background worker
                      listens to RabbitMQ queue
                      saves click events to MongoDB

analytics-service   → HTTP API
                      reads from MongoDB
                      serves stats like totalClicks, topUserAgents
```

---

## Why Not Save Directly to MongoDB?

This is the core question. You *could* do this:

```
User clicks short URL
  → url-service handles redirect
  → url-service writes to MongoDB     ← direct write
  → url-service returns 302
```

The problem is **speed and reliability**:

```
MongoDB write takes ~20-50ms
Every single redirect now costs 20-50ms extra

At scale:
  10,000 clicks/second
  → 10,000 MongoDB writes/second
  → MongoDB gets overwhelmed
  → redirects slow down or fail
  → users experience lag on every click
```

> The redirect is the most critical operation in the system. It must be as fast as possible — ideally **under 5ms**.

---

## Why RabbitMQ Solves This

```
User clicks short URL
  → url-service handles redirect
  → url-service publishes to RabbitMQ  ← ~1ms, fire and forget
  → url-service returns 302 immediately

Meanwhile (asynchronously):
  → analytics-worker picks up the message
  → writes to MongoDB at its own pace
  → even if MongoDB is slow, redirects are not affected
```

### Performance Comparison

```
With RabbitMQ:
  redirect cost    = cache lookup (~2ms) or DB lookup (~10ms)
  analytics cost   = 0ms for the user — happens in background

Without RabbitMQ:
  redirect cost    = cache/DB lookup + MongoDB write (~60ms total)
  user waits longer on every single click
```

---

## The Other Benefit — Resilience

```
MongoDB goes down for 5 minutes

  Without RabbitMQ:
    → every redirect fails or is slow
    → click data is lost

  With RabbitMQ:
    → redirects keep working perfectly
    → click events queue up in RabbitMQ
    → when MongoDB comes back up
    → analytics-worker drains the queue
    → no click data lost
```

---

## Simple Analogy

```
Restaurant kitchen analogy:

Without RabbitMQ:
  Waiter takes order → runs to kitchen → waits for receipt → comes back
  Customer waits the whole time

With RabbitMQ:
  Waiter takes order → drops ticket in queue → comes back immediately
  Kitchen processes tickets at their own pace
  Customer gets served faster
```

---

## Why Two Separate Services? (worker + service)

```
analytics-worker   → only writes to MongoDB (no HTTP)
analytics-service  → only reads from MongoDB (HTTP API)

If you combined them:
  heavy write load could slow down read responses
  scaling becomes harder

Separated:
  scale worker independently if writes are slow
  scale service independently if reads are slow
  one crashing does not affect the other
```

---

## RabbitMQ vs Kafka — What Is The Difference

Think of two different post offices.

### RabbitMQ — Regular Post Office

```
→ You drop a letter
→ Post office delivers it to ONE recipient
→ Once delivered, letter is gone
→ Good for tasks that need to be done once

Example: send one email, process one payment, store one click event
```

### Kafka — Newspaper Printing Press

```
→ You print one newspaper
→ Thousands of people can read the SAME newspaper
→ Newspaper stays available for days/weeks
→ Good for events that MANY systems need to read

Example: a bank transaction that needs to
  → update balance         (system 1)
  → send notification      (system 2)
  → update fraud detection (system 3)
  → generate statement     (system 4)

All four systems read the same event.
```

### When to Use Which

```
RabbitMQ → one sender, one receiver, task is done once
           payment processing, email sending, our click events

Kafka    → one sender, many receivers, data needs to be replayed
           stock price updates, bank transactions, user activity feeds
           used by LinkedIn, Uber, Netflix at massive scale
```

---

## Why Not Just Poll the API or Use WebSockets?

### Polling the API Every Few Seconds

Imagine checking your phone for new messages every 5 seconds even when nobody has sent you anything.

```
In tech:
  → Your app calls the API every 5 seconds
  → "Any new clicks? No. Any new clicks? No. Any new clicks? Yes!"
  → 99% of calls are wasted
  → At scale with 1 million users:
     1,000,000 users × 12 calls per minute = 12,000,000 API calls/minute
  → Servers on fire
  → Expensive and wasteful
```

### WebSockets

WebSocket is like leaving a phone call open — both sides can talk anytime.

```
Good for:
  → Live chat apps (WhatsApp, Slack)
  → Live sports scores
  → Multiplayer games
  → Stock price tickers

But for our analytics:
  → We do not need to show clicks in real time
  → The user does not sit watching their click counter go up
  → We just need the data to be there when they check
  → WebSocket connection costs memory on the server
  → 1 million open WebSocket connections = server runs out of memory
```

### RabbitMQ / Event Queue

```
No connection stays open
No polling needed
No wasted calls

Event happens → message sent → worker processes → data saved
Clean, efficient, works at any scale
```

---

## Why Event-Driven Architecture

Think of how the real world works.

### Old Way — Direct / Synchronous

```
You call a plumber
  → Plumber says "stay on the phone while I drive to your house"
  → You wait 45 minutes on hold doing nothing
  → Plumber arrives, fixes pipe, you hang up

You are blocked the entire time.
Nothing else can happen until the plumber finishes.
```

### New Way — Event Driven / Asynchronous

```
You call a plumber
  → Plumber says "I got your request, I will come between 2-4pm"
  → You hang up immediately
  → You go about your day
  → Plumber arrives, fixes pipe, sends you a text when done

You are free to do other things.
The system continues working without blocking anyone.
```

### In Our URL Shortener

```
Old way (without events):
  User clicks → url-service → write to MongoDB → write to PostgreSQL → redirect
  User is waiting for ALL of that to finish
  If MongoDB is slow, user is slow
  If MongoDB crashes, redirect crashes

New way (event driven):
  User clicks → url-service → redirect immediately  (user is free)
                            → drop event in queue   (background)
  analytics-worker picks up event → writes to MongoDB (background)
  If MongoDB is slow, user never knows
  If MongoDB crashes, events queue up and replay when it comes back
```

---

## Real World Companies Using This

### Uber

```
Driver accepts ride    → event published
  → Notification service reads event → sends push to rider
  → Billing service reads event      → starts fare calculation
  → Analytics reads event            → updates driver stats
  → Maps service reads event         → starts route tracking

One event, four systems react — none of them slow down the ride accept.
```

### Amazon

```
Customer places order  → event published
  → Warehouse reads event    → starts picking items
  → Payment reads event      → charges card
  → Email reads event        → sends confirmation
  → Analytics reads event    → updates sales dashboard

You see "Order confirmed" in 1 second.
All the other work happens behind the scenes.
```

### Netflix

```
You press play         → event published
  → Video starts streaming immediately
  → Recommendation engine updates your taste profile  (background)
  → Analytics records what you watched               (background)
  → Billing calculates usage                         (background)

You never wait for any of that — you just watch your show.
```

---

## One Line Summary

RabbitMQ / Kafka / Event Architecture solves one problem:

> *"How do we respond to the user instantly while still doing all the hard work in the background?"*

The answer is always the same:

```
Do the minimum needed for the user right now.
Queue everything else.
Let background workers handle it later.
```

---

> This is the foundation of event-driven microservice architecture — and exactly what companies like **Twitter**, **Uber**, and **LinkedIn** use at scale.
