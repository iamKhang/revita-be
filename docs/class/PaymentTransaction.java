import java.time.LocalDateTime;
import java.util.Map;

public class PaymentTransaction {
    private String id;
    private String invoiceId;
    private float amount;
    private String currency;
    private PaymentTransactionStatus status;
    private String providerTransactionId;
    private String orderCode;
    private String paymentUrl;
    private String qrCode;
    private LocalDateTime expiredAt;
    private LocalDateTime paidAt;
    private Map<String, Object> lastWebhookPayload;
    private String lastWebhookStatus;
    private LocalDateTime lastWebhookAt;
    private boolean isVerified;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Invoice invoice;
    
    public PaymentTransaction() {
    }
}

