import java.time.LocalDateTime;
import java.util.List;

public class PrescriptionService {
    private String prescriptionId;
    private String serviceId;
    private String doctorId;
    private String technicianId;
    private PrescriptionStatus status;
    private List<String> results;
    private int order;
    private int callCount;
    private int skipCount;
    private String appointmentId;
    private String note;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String boothId;
    private String clinicRoomId;
    private String workSessionId;
    
    // Quan hệ nhiều-một
    private Prescription prescription;
    private Service service;
    private Doctor doctor;
    private Technician technician;
    private Appointment appointment;
    private Booth booth;
    private ClinicRoom clinicRoom;
    private WorkSession workSession;
    
    public PrescriptionService() {
    }
}

