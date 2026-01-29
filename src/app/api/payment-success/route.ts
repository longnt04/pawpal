import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: Request) {
  try {
    const { orderCode, userId, items } = await req.json();

    if (!orderCode || !userId || !items?.length) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 🧾 Lấy product_id đúng cách
    const productIds = items
      .map((i: any) => i.products?.id)
      .filter(Boolean);

    // 🔍 Lấy giá thật từ DB
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, price")
      .in("id", productIds);

    if (productError) throw productError;

    const priceMap: Record<string, number> = {};
    products.forEach((p) => {
      priceMap[p.id] = p.price;
    });

    // 🧮 Tính tổng tiền chuẩn
    const totalAmount = items.reduce((sum: number, item: any) => {
      const productId = item.products?.id;
      const price = priceMap[productId] ?? 0;
      return sum + price * item.quantity;
    }, 0);


    // 🧾 1. Tạo order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        total_price: totalAmount,
        status: "processing",
        order_code: orderCode,
        payment_method: "bank",
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 📦 2. Insert order_items với giá chuẩn
    const orderItems = items.map((item: any) => {
      const productId = item.products?.id;

      return {
        order_id: order.id,
        product_id: productId,
        price: priceMap[productId], // ✅ không còn undefined
        quantity: item.quantity,
      };
    });

    const { error: itemError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemError) throw itemError;


    // 💳 3. Transaction
    await supabase.from("transactions").insert({
      order_id: order.id,
      provider: "payos",
      transaction_code: orderCode,
      amount: totalAmount,
      status: "success",
    });

    // 🧹 4. Xoá cart
    await supabase.from("cart_items").delete().eq("user_id", userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PAYMENT SUCCESS ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
