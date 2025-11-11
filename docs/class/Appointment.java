import java.time.LocalDateTime;
import java.util.List;

public class Appointment {
    private String id;
    private String appointmentCode;
    private String patientProfileId;
    private String specialtyId;
    private String doctorId;
    private String serviceId;
    private String bookerId;
    private String status;
    private LocalDateTime date;
    private String startTime;
    private String endTime;
    private String workSessionId;
    
    // Quan hệ nhiều-một
    private PatientProfile patientProfile;
    private Specialty specialty;
    private Doctor doctor;
    private Service service;
    private WorkSession workSession;
    
    // Quan hệ một-nhiều
    private List<AppointmentService> appointmentServices;
    private List<PrescriptionService> prescriptionServices;
    private List<MedicalRecord> medicalRecords;
    
    public Appointment() {
    }
}

