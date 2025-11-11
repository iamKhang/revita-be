import java.util.List;

public class Doctor {
    private String id;
    private String doctorCode;
    private String authId;
    private int yearsExperience;
    private float rating;
    private int ratingCount;
    private String workHistory;
    private String description;
    private String specialtyId;
    private List<String> subSpecialties;
    private String position;
    private boolean isActive;
    
    // Quan hệ nhiều-một
    private Auth auth;
    private Specialty specialty;
    
    // Quan hệ một-nhiều
    private List<Appointment> appointments;
    private List<MedicalRecord> medicalRecords;
    private List<Prescription> prescriptions;
    private List<WorkSession> workSessions;
    private List<PrescriptionService> prescriptionServices;
    private List<MedicationPrescription> medicationPrescriptions;
    private List<Certificate> certificates;
    private List<DoctorRating> ratings;
    
    public Doctor() {
    }
}

