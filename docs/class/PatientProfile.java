import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class PatientProfile {
    private String id;
    private String profileCode;
    private String patientId;
    private String name;
    private String phone;
    private LocalDateTime dateOfBirth;
    private String gender;
    private String address;
    private String occupation;
    private Map<String, Object> emergencyContact;
    private String healthInsurance;
    private String relationship;
    private boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean isPregnant;
    private boolean isDisabled;
    
    // Quan hệ nhiều-một
    private Patient patient;
    
    // Quan hệ một-nhiều
    private List<Appointment> appointments;
    private List<MedicalRecord> medicalRecords;
    private List<Prescription> prescriptions;
    private List<Invoice> invoices;
    private List<MedicationPrescription> medicationPrescriptions;
    
    public PatientProfile() {
    }
}

