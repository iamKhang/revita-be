import java.time.LocalDateTime;
import java.util.Map;

public class MedicalRecordHistory {
    private String id;
    private String medicalRecordId;
    private String changedBy;
    private LocalDateTime changedAt;
    private Map<String, Object> changes;
    
    // Quan hệ nhiều-một
    private MedicalRecord medicalRecord;
    
    public MedicalRecordHistory() {
    }
}

