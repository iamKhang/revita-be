import java.time.LocalDateTime;
import java.util.List;

public class WorkSession {
    private String id;
    private String boothId;
    private String doctorId;
    private String technicianId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime nextAvailableAt;
    private WorkSessionStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Booth booth;
    private Doctor doctor;
    private Technician technician;
    
    // Quan hệ một-nhiều
    private List<WorkSessionService> services;
    private List<AppointmentService> appointmentServices;
    private List<Appointment> appointments;
    private List<PrescriptionService> prescriptionServices;
    
    public WorkSession() {
    }
}

