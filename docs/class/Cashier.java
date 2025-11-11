import java.util.List;

public class Cashier {
    private String id;
    private String cashierCode;
    private String authId;
    private boolean isActive;
    
    // Quan hệ nhiều-một
    private Auth auth;
    
    // Quan hệ một-nhiều
    private List<Invoice> invoices;
    
    public Cashier() {
    }
}

