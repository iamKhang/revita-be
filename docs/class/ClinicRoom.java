import java.time.LocalDateTime;
import java.util.List;

public class ClinicRoom {
    private String id;
    private String roomCode;
    private String roomName;
    private String specialtyId;
    private String description;
    private String address;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private Specialty specialty;
    
    // Quan hệ một-nhiều
    private List<Booth> booth;
    private List<ClinicRoomService> services;
    private List<PrescriptionService> prescriptionServices;
    
    public ClinicRoom() {
    }
}

