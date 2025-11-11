import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class Template {
    private String id;
    private String templateCode;
    private String name;
    private Map<String, Object> fields;
    private boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String specialtyId;
    
    // Quan hệ nhiều-một
    private Specialty specialty;
    
    // Quan hệ một-nhiều
    private List<MedicalRecord> medicalRecords;
    
    public Template() {
    }
}

