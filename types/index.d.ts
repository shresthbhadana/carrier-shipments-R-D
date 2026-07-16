export interface Package {
    weight: number;
    length: number;
    width: number;
    height: number;
}

export interface RatePayload {
    pickupPincode: string;
    deliveryPincode: string;
    weight: number;
    pickupAddress?: string;
    pickupCity?: string;
    pickupState?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryState?: string;
    packages?: Package[];
    cod?: boolean;
}

export interface RateResponse {
    courierId: string;
    courierName: string;
    baseShippingPrice: number;
    platformFee: number;
    gstAmount: number;
    shippingPrice: number;
    estimatedDays: number;
    serviceType: string;
}

export interface InitiatePaymentPayload {
    orderId: string;
    courierName: string;
    customerName: string;
    customerPhone: string;
    pickupPincode: string;
    deliveryPincode: string;
    weight: number;
    pickupAddress?: string;
    pickupCity?: string;
    pickupState?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryState?: string;
    packages?: Package[];
}

export interface VerifyPaymentPayload {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}
