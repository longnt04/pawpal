import { PayOS } from "@payos/node";
import { NextResponse } from "next/server";

const payos = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_CLIENT_SECRET,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, userId } = body;

    const totalAmount = items.reduce(
      (sum: number, item: any) => sum + item.products.price * item.quantity,
      0
    );

    const orderCode = Date.now(); // unique

    const paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: totalAmount,
      description: `Đơn hàng #${orderCode}`,
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/cancel`,
      items: items.map((item: any) => ({
        name: item.products.name,
        quantity: item.quantity,
        price: item.products.price,
      })),
    });

    return NextResponse.json({ checkoutUrl: paymentLink.checkoutUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Payment error" }, { status: 500 });
  }
}
