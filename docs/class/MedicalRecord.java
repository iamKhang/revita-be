import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class MedicalRecord {
    private String id;
    private String medicalRecordCode;
    private String templateId;
    private String patientProfileId;
    private String doctorId;
    private String appointmentId;
    private Map<String, Object> content;
    private boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private MedicalRecordStatus status;
    
    // Quan hệ nhiều-một
    private Template template;
    private PatientProfile patientProfile;
    private Doctor doctor;
    private Appointment appointment;
    
    // Quan hệ một-nhiều
    private List<MedicalRecordHistory> histories;
    private List<Prescription> prescriptions;
    private List<MedicationPrescription> medicationPrescriptions;
    
    public MedicalRecord() {
    }
}

