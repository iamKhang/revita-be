import java.time.LocalDateTime;
import java.util.List;

public class Service {
    private String id;
    private String serviceCode;
    private String name;
    private Float price;
    private String description;
    private Integer durationMinutes;
    private boolean isActive;
    private String unit;
    private String currency;
    private String categoryId;
    private String specialtyId;
    private boolean requiresDoctor;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Quan hệ nhiều-một
    private ServiceCategory category;
    private Specialty specialty;
    
    // Quan hệ một-nhiều
    private List<PackageItem> packageItems;
    private List<ClinicRoomService> clinicRoomServices;
    private List<PrescriptionService> prescriptions;
    private List<InvoiceDetail> invoiceDetails;
    private List<WorkSessionService> workSessionServices;
    private List<AppointmentService> appointmentServices;
    private List<Appointment> appointments;
    private List<BoothService> boothServices;
    
    public Service() {
    }
}

