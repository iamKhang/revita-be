public class InvoiceDetail {
    private String invoiceId;
    private String serviceId;
    private float price;
    private String prescriptionId;
    
    // Quan hệ nhiều-một
    private Invoice invoice;
    private Service service;
    private Prescription prescription;
    
    public InvoiceDetail() {
    }
}

