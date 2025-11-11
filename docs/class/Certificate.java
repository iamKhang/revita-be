import java.time.LocalDateTime;

public class Certificate {
    private String id;
    private String code;
    private String title;
    private CertificateType type;
    private String issuedBy;
    private LocalDateTime issuedAt;
    private LocalDateTime expiryAt;
    private String file;
    private String description;
    private String doctorId;
    private String technicianId;
    
    // Quan hệ nhiều-một
    private Doctor doctor;
    private Technician technician;
    
    public Certificate() {
    }
}

