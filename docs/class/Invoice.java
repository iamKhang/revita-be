import java.time.LocalDateTime;
import java.util.List;

public class Invoice {
    private String id;
    private String invoiceCode;
    private float totalAmount;
    private float amountPaid;
    private float changeAmount;
    private PaymentMethod paymentMethod;
    private String paymentStatus;
    private LocalDateTime createdAt;
    private boolean isPaid;
    private String patientProfileId;
    private String cashierId;
    
    // Quan hệ nhiều-một
    private PatientProfile patientProfile;
    private Cashier cashier;
    
    // Quan hệ một-nhiều
    private List<InvoiceDetail> invoiceDetails;
    private List<PaymentTransaction> paymentTransactions;
    
    public Invoice() {
    }
}

