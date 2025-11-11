import java.util.List;

public class Prescription {
    private String id;
    private String prescriptionCode;
    private String doctorId;
    private String patientProfileId;
    private String note;
    private PrescriptionStatus status;
    private String medicalRecordId;
    
    // Quan hệ nhiều-một
    private Doctor doctor;
    private PatientProfile patientProfile;
    private MedicalRecord medicalRecord;
    
    // Quan hệ một-nhiều
    private List<PrescriptionService> services;
    private List<InvoiceDetail> invoiceDetails;
    
    public Prescription() {
    }
}

