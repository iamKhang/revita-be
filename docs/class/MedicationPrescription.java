import java.time.LocalDateTime;
import java.util.List;

public class MedicationPrescription {
    private String id;
    private String code;
    private String doctorId;
    private String patientProfileId;
    private String medicalRecordId;
    private String note;
    private MedicationPrescriptionStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Doctor doctor;
    private PatientProfile patientProfile;
    private MedicalRecord medicalRecord;
    
    // Quan hệ một-nhiều
    private List<MedicationPrescriptionItem> items;
    
    public MedicationPrescription() {
    }
}

