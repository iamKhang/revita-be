import java.time.LocalDateTime;

public class DoctorRating {
    private String id;
    private String doctorId;
    private String patientId;
    private int rating;
    private String comment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Doctor doctor;
    private Patient patient;
    
    public DoctorRating() {
    }
}

